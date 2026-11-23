# Keep the JS bridge methods callable from the WebView.
-keepclassmembers class com.mason.tv.MasonBridge {
    @android.webkit.JavascriptInterface <methods>;
}
