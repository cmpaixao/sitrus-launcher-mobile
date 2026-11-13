package com.sitrus.launcher.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SitrusDownloadsPlugin.class);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        if (getBridge() == null) return;
        PluginHandle handle = getBridge().getPlugin("SitrusDownloads");
        if (handle != null && handle.getInstance() instanceof SitrusDownloadsPlugin) {
            ((SitrusDownloadsPlugin) handle.getInstance()).openPackIfReady();
        }
    }
}
