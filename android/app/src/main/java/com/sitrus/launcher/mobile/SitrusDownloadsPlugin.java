package com.sitrus.launcher.mobile;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.io.File;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SitrusDownloads")
public class SitrusDownloadsPlugin extends Plugin {
    @PluginMethod
    public void enqueue(PluginCall call) {
        String url = call.getString("url");
        String filename = call.getString("filename", "sitrus.mrpack");
        if (url == null || url.trim().isEmpty()) {
            call.reject("Sem link para baixar.");
            return;
        }
        if (filename.contains("/") || filename.contains("\\")) {
            call.reject("Nome de arquivo inválido.");
            return;
        }

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
}
