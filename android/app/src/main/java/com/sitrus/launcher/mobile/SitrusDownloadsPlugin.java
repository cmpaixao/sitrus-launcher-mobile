package com.sitrus.launcher.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SitrusDownloads")
public class SitrusDownloadsPlugin extends Plugin {
    private static final String ENGINE_PACKAGE = "com.movtery.zalithlauncher.v2";
    private static final String IMPORT_ACTIVITY = "com.movtery.activity.ImportModpackActivity";
    private static final long ENGINE_MIN_BYTES = 80L * 1024L * 1024L;
    private volatile boolean openPackWhenInstalled = false;
    private volatile File pendingPack = null;

    @PluginMethod
    public void deviceAbi(PluginCall call) {
        JSObject result = new JSObject();
        result.put("abi", preferredAbi());
        call.resolve(result);
    }

    @PluginMethod
    public void engineInstalled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("installed", isEngineInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void play(PluginCall call) {
        String packUrl = call.getString("packUrl");
        String filename = call.getString("filename", "sitrus.mrpack");
        String engineUrl = call.getString("engineUrl", "");
        if (packUrl == null || packUrl.trim().isEmpty()) {
            call.reject("Sem link do pack.");
            return;
        }
        final String safeEngineUrl = engineUrl == null ? "" : engineUrl;
        new Thread(() -> prepareAndOpen(call, packUrl, safeEngineUrl), "sitrus-play").start();
    }

    @PluginMethod
    public void openPending(PluginCall call) {
        openPackIfReady();
        JSObject result = new JSObject();
        result.put("opened", !openPackWhenInstalled && pendingPack != null);
        call.resolve(result);
    }

    public void openPackIfReady() {
        File pack = pendingPack;
        if (!openPackWhenInstalled || pack == null || !pack.isFile()) return;
        if (!isEngineInstalled()) return;
        openPackWhenInstalled = false;
        try {
            openPack(pack);
        } catch (RuntimeException error) {
            openPackWhenInstalled = true;
        }
    }

    private void prepareAndOpen(PluginCall call, String packUrl, String engineUrl) {
        try {
            Context context = getContext();
            if (context == null) {
                call.reject("O Sitrus não está aberto.");
                return;
            }
            File dir = new File(context.getCacheDir(), "sitrus");
            if (!dir.isDirectory() && !dir.mkdirs()) {
                call.reject("Não deu para preparar a pasta do jogo.");
                return;
            }
            File pack = new File(dir, "sitrus-mobile.mrpack");
            report(8, "Baixando o modpack...");
            download(packUrl, pack, 8, 35, "Baixando o modpack...");
            pendingPack = pack;
            if (!isEngineInstalled()) {
                if (engineUrl.trim().isEmpty()) {
                    call.reject("Não deu para preparar o jogo. Confira a internet e toque em Jogar de novo.");
                    return;
                }
                File apk = new File(dir, "engine.apk");
                if (!apk.isFile() || apk.length() < ENGINE_MIN_BYTES) {
                    report(36, "Preparando o jogo neste celular. A primeira vez demora.");
                    download(engineUrl, apk, 36, 92, "Preparando o jogo neste celular...");
                }
                openPackWhenInstalled = true;
                String step = openEngineInstaller(apk);
                JSObject result = new JSObject();
                result.put("step", step);
                call.resolve(result);
                return;
            }
            openPackWhenInstalled = false;
            report(96, "Abrindo o modpack...");
            openPack(pack);
            JSObject result = new JSObject();
            result.put("step", "import");
            call.resolve(result);
        } catch (Exception error) {
            String message = error.getMessage();
            call.reject(message == null || message.trim().isEmpty() ? "Não deu para preparar o jogo." : message);
        }
    }
    @PluginMethod
    public void enqueue(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename", "sitrus.mrpack");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Sem link para baixar.");
            return;
        }
        filename = safeFileName(filename);

        askForDownloadNotification();

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(filename);
        request.setDescription("Sitrus Launcher");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        request.setMimeType("application/octet-stream");

        DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            call.reject("O celular não abriu o gerenciador de downloads.");
            return;
        }
        long id = manager.enqueue(request);
        JSObject result = new JSObject();
        result.put("id", id);
        call.resolve(result);
    }

    @PluginMethod
    public void uninstall(PluginCall call) {
        Context context = getContext();
        Activity activity = getActivity();
        if (context == null || activity == null) {
            call.reject("Não deu para abrir a desinstalação.");
            return;
        }
        deleteOurDownloads(context);
        deleteChildren(context.getCacheDir());
        deleteChildren(context.getExternalCacheDir());
        deleteChildren(context.getExternalFilesDir(null));

        Intent intent = new Intent(Intent.ACTION_DELETE);
        intent.setData(Uri.parse("package:" + context.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        activity.runOnUiThread(() -> activity.startActivity(intent));

        JSObject result = new JSObject();
        result.put("ok", true);
        call.resolve(result);
    }

    private void deleteOurDownloads(Context context) {
        DownloadManager manager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) return;
        Cursor cursor = manager.query(new DownloadManager.Query());
        if (cursor == null) return;
        try {
            int idColumn = cursor.getColumnIndex(DownloadManager.COLUMN_ID);
            int titleColumn = cursor.getColumnIndex(DownloadManager.COLUMN_TITLE);
            int localColumn = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);
            while (cursor.moveToNext()) {
                long id = idColumn >= 0 ? cursor.getLong(idColumn) : -1;
                String title = titleColumn >= 0 ? cursor.getString(titleColumn) : null;
                String local = localColumn >= 0 ? cursor.getString(localColumn) : null;
                if (id >= 0) manager.remove(id);
                deleteDownloadUri(context, local);
                if (title != null && !title.contains("/") && !title.contains("\\")) {
                    File file = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), title);
                    if (file.isFile()) file.delete();
                }
            }
        } finally {
            cursor.close();
        }
    }

    private void deleteDownloadUri(Context context, String local) {
        if (local == null || local.isEmpty()) return;
        Uri uri = Uri.parse(local);
        if ("file".equals(uri.getScheme()) && uri.getPath() != null) {
            new File(uri.getPath()).delete();
            return;
        }
        try {
            context.getContentResolver().delete(uri, null, null);
        } catch (Exception ignored) {
            // o gerenciador de downloads já removeu o registro
        }
    }

    private void deleteChildren(File directory) {
        if (directory == null || !directory.isDirectory()) return;
        File[] children = directory.listFiles();
        if (children == null) return;
        for (File child : children) deleteTree(child);
    }

    private void deleteTree(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) deleteTree(child);
            }
        }
        file.delete();
    }

    private void askForDownloadNotification() {
        if (Build.VERSION.SDK_INT < 33) return;
        Context context = getContext();
        Activity activity = getActivity();
        if (context == null || activity == null) return;
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ActivityCompat.requestPermissions(activity, new String[] {Manifest.permission.POST_NOTIFICATIONS}, 4101);
    }

    private boolean isEngineInstalled() {
        Context context = getContext();
        if (context == null) return false;
        try {
            context.getPackageManager().getPackageInfo(ENGINE_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException error) {
            return false;
        }
    }

    private String preferredAbi() {
        String[] abis = Build.SUPPORTED_ABIS;
        if (abis == null) return "arm64-v8a";
        for (String abi : abis) {
            if ("arm64-v8a".equals(abi) || "armeabi-v7a".equals(abi) || "x86_64".equals(abi) || "x86".equals(abi)) {
                return abi;
            }
        }
        return "arm64-v8a";
    }

    private String safeFileName(String filename) {
        if (filename == null) return "sitrus.mrpack";
        String cleaned = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        if (cleaned.isEmpty() || ".".equals(cleaned) || "..".equals(cleaned)) return "sitrus.mrpack";
        return cleaned;
    }

    private void report(int percent, String message) {
        JSObject data = new JSObject();
        data.put("percent", percent);
        data.put("message", message);
        notifyListeners("progress", data);
    }

    private void download(String urlString, File dest, int from, int to, String message) throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(120000);
        conn.setRequestProperty("User-Agent", "SitrusLauncher");
        conn.setRequestProperty("Accept", "*/*");
        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
            conn.disconnect();
            throw new IOException("Download falhou (" + code + ").");
        }
        long total = conn.getContentLengthLong();
        File part = new File(dest.getParentFile(), dest.getName() + ".part");
        try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(part)) {
            byte[] buffer = new byte[64 * 1024];
            long read = 0;
            int last = -1;
            int count;
            while ((count = in.read(buffer)) >= 0) {
                out.write(buffer, 0, count);
                read += count;
                int percent = total > 0 ? from + (int) ((read * (to - from)) / total) : from;
                if (percent != last) {
                    last = percent;
                    report(percent, message);
                }
            }
        } finally {
            conn.disconnect();
        }
        if (dest.exists() && !dest.delete()) {
            part.delete();
            throw new IOException("Não deu para substituir o arquivo anterior.");
        }
        if (!part.renameTo(dest)) {
            part.delete();
            throw new IOException("Não deu para salvar o arquivo.");
        }
    }

    private String openEngineInstaller(File apk) {
        Context context = getContext();
        if (context == null) throw new IllegalStateException("O Sitrus não está aberto.");
        if (Build.VERSION.SDK_INT >= 26 && !context.getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            settings.setData(Uri.parse("package:" + context.getPackageName()));
            settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startOnUi(settings);
            return "allow-install";
        }
        Uri uri = fileUri(apk);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.setClipData(ClipData.newRawUri("engine", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startOnUi(intent);
        return "install-engine";
    }

    private void openPack(File pack) {
        Context context = getContext();
        if (context == null) throw new IllegalStateException("O Sitrus não está aberto.");
        Uri uri = fileUri(pack);
        context.grantUriPermission(ENGINE_PACKAGE, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setComponent(new ComponentName(ENGINE_PACKAGE, IMPORT_ACTIVITY));
        intent.setDataAndType(uri, "application/zip");
        intent.setClipData(ClipData.newRawUri("modpack", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        startOnUi(intent);
    }

    private Uri fileUri(File file) {
        Context context = getContext();
        return FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
    }

    private void startOnUi(Intent intent) {
        Activity activity = getActivity();
        if (activity == null) throw new IllegalStateException("O Sitrus não está em primeiro plano.");
        activity.runOnUiThread(() -> activity.startActivity(intent));
    }
}
