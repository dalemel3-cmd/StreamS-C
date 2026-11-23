package com.mason.tv

import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface

/** Exposed to pages as window.MasonTV. Keep this tiny: no files, no settings. */
class MasonBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun nextScreen() = activity.runOnUiThread { activity.step(1) }

    @JavascriptInterface
    fun prevScreen() = activity.runOnUiThread { activity.step(-1) }

    @JavascriptInterface
    fun getDeviceName(): String =
        Settings.Global.getString(activity.contentResolver, Settings.Global.DEVICE_NAME) ?: Build.MODEL
}
