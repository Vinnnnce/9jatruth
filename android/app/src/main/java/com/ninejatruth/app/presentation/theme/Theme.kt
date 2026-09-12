package com.ninejatruth.app.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = NigeriaGreen,
    onPrimary = TextOnGreen,
    primaryContainer = NigeriaGreenLight,
    onPrimaryContainer = TextOnGreen,
    secondary = NigeriaYellow,
    onSecondary = TextOnYellow,
    secondaryContainer = NigeriaYellowLight,
    onSecondaryContainer = TextOnYellow,
    tertiary = AccentTeal,
    onTertiary = TextOnGreen,
    background = BgPrimary,
    onBackground = TextPrimary,
    surface = BgCard,
    onSurface = TextPrimary,
    surfaceVariant = BgSecondary,
    onSurfaceVariant = TextSecondary,
    outline = BorderLight,
    outlineVariant = Divider,
    error = AccentRed,
    onError = TextOnGreen,
    errorContainer = AccentRed.copy(alpha = 0.1f),
    onErrorContainer = TextPrimary
)

private val DarkColorScheme = darkColorScheme(
    primary = NigeriaGreenLight,
    onPrimary = TextOnGreen,
    primaryContainer = NigeriaGreen,
    onPrimaryContainer = TextOnGreen,
    secondary = NigeriaYellow,
    onSecondary = TextOnYellow,
    secondaryContainer = NigeriaYellowDark,
    onSecondaryContainer = TextOnYellow,
    tertiary = AccentTeal,
    onTertiary = TextOnGreen,
    background = DarkBgPrimary,
    onBackground = DarkTextPrimary,
    surface = DarkBgCard,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkBgSecondary,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    outlineVariant = DarkBorder,
    error = AccentRed,
    onError = TextOnGreen,
    errorContainer = AccentRed.copy(alpha = 0.2f),
    onErrorContainer = TextOnGreen
)

@Composable
fun NinejaTruthTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        shapes = Shapes,
        content = content
    )
}
