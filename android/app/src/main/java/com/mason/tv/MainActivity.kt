package com.mason.tv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import java.util.concurrent.Executors

class MainActivity : Activity() {

    private lateinit var web: WebView
    private lateinit var offline: TextView
    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()

    private var screens: List<Screen> = emptyList()
    private var index = 0
    private var pendingScreen: String? = null
    private var failed = false

    private val retry = Runnable { reload() }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
            isFocusable = true
            isFocusableInTouchMode = true
            addJavascriptInterface(MasonBridge(this@MainActivity), "MasonTV")
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView, url: String) {
                    if (!failed) offline.visibility = View.GONE
                }

                override fun onReceivedError(view: WebView, req: WebResourceRequest, err: WebResourceError) {
                    if (req.isForMainFrame) showOffline()
                }
            }
        }

        offline = TextView(this).apply {
            text = getString(R.string.reconnecting)
            setTextColor(Color.WHITE)
            textSize = 32f
            gravity = Gravity.CENTER
            setBackgroundColor(Color.BLACK)
            visibility = View.GONE
        }

        setContentView(FrameLayout(this).apply {
            addView(web, FrameLayout.LayoutParams(-1, -1))
            addView(offline, FrameLayout.LayoutParams(-1, -1))
        })

        pendingScreen = intent.getStringExtra("screen")
        loadScreens()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        intent.getStringExtra("screen")?.let { name ->
            if (screens.isEmpty()) pendingScreen = name else openByName(name)
        }
    }

    override fun onResume() {
        super.onResume()
        hideSystemBars()
        web.onResume()
        web.requestFocus()
    }

    override fun onPause() {
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        main.removeCallbacksAndMessages(null)
        io.shutdownNow()
        web.destroy()
        super.onDestroy()
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action != KeyEvent.ACTION_DOWN) {
            return when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT,
                KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_BACK -> true
                else -> super.dispatchKeyEvent(event)
            }
        }
        return when (event.keyCode) {
            KeyEvent.KEYCODE_DPAD_RIGHT -> { requestStep(1); true }
            KeyEvent.KEYCODE_DPAD_LEFT -> { requestStep(-1); true }
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> {
                web.evaluateJavascript("window.masonTv && window.masonTv.onOk && window.masonTv.onOk()", null)
                true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (failed || offline.visibility == View.VISIBLE) {
                    finish()
                } else {
                    web.evaluateJavascript(
                        "(function(){return !!(window.masonTv&&window.masonTv.onBack&&window.masonTv.onBack());})()"
                    ) { res ->
                        if (res != "true") {
                            if (web.canGoBack()) web.goBack() else finish()
                        }
                    }
                }
                true
            }
            // Everything else (up/down, media keys) goes to the page.
            else -> super.dispatchKeyEvent(event)
        }
    }

    private fun requestStep(delta: Int) {
        if (failed || offline.visibility == View.VISIBLE) {
            step(delta)
            return
        }
        web.evaluateJavascript(
            "(function(){return !!(window.masonTv&&window.masonTv.onStep&&window.masonTv.onStep($delta));})()"
        ) { res ->
            if (res != "true") step(delta)
        }
    }

    fun syncPath(path: String) {
        val i = screens.indexOfFirst { it.path == path }
        if (i >= 0) index = i
    }

    fun step(delta: Int) {
        if (screens.isEmpty()) return
        index = Math.floorMod(index + delta, screens.size)
        open()
    }

    private fun loadScreens() {
        io.execute {
            val list = Screens.load(applicationContext)
            main.post {
                screens = list
                val wanted = pendingScreen
                pendingScreen = null
                if (wanted != null) openByName(wanted) else open()
            }
        }
    }

    private fun openByName(name: String) {
        val i = screens.indexOfFirst { it.name.equals(name, ignoreCase = true) }
        if (i >= 0) index = i
        open()
    }

    private fun open() {
        if (screens.isEmpty()) return
        failed = false
        main.removeCallbacks(retry)
        web.loadUrl(BuildConfig.BASE_URL + screens[index].path)
    }

    private fun reload() {
        // Refetch the list too, in case it changed while offline.
        if (screens.isEmpty()) loadScreens() else open()
    }

    private fun showOffline() {
        failed = true
        offline.visibility = View.VISIBLE
        main.removeCallbacks(retry)
        main.postDelayed(retry, 30_000)
    }

    @Suppress("DEPRECATION")
    private fun hideSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        }
    }
}
