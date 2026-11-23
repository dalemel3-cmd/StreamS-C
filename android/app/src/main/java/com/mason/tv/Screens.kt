package com.mason.tv

import android.content.Context
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class Screen(val name: String, val path: String, val refreshSec: Int)

/** Loads the screen list from BASE_URL/screens.json, falling back to the last good copy. */
object Screens {
    private const val PREFS = "screens"
    private const val KEY = "json"

    // Used only if the network is down on the very first launch.
    private val DEFAULT = listOf(Screen("clock", "/clock", 600))

    /** Blocking: call off the main thread. */
    fun load(context: Context): List<Screen> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return try {
            val json = fetch("${BuildConfig.BASE_URL}/screens.json")
            val list = parse(json)
            if (list.isNotEmpty()) prefs.edit().putString(KEY, json).apply()
            list.ifEmpty { DEFAULT }
        } catch (e: Exception) {
            prefs.getString(KEY, null)?.let { runCatching { parse(it) }.getOrNull() }
                ?.takeIf { it.isNotEmpty() } ?: DEFAULT
        }
    }

    private fun fetch(url: String): String {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 8_000
        conn.readTimeout = 8_000
        conn.useCaches = false
        try {
            if (conn.responseCode != 200) error("screens.json HTTP ${conn.responseCode}")
            return conn.inputStream.bufferedReader().use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun parse(json: String): List<Screen> {
        val arr = JSONObject(json).getJSONArray("screens")
        return (0 until arr.length()).map {
            val o = arr.getJSONObject(it)
            Screen(o.getString("name"), o.getString("path"), o.optInt("refreshSec", 300))
        }
    }
}
