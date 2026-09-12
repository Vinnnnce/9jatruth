package com.ninejatruth.app.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ninejatruth.app.presentation.theme.TruthHigh
import com.ninejatruth.app.presentation.theme.TruthLow
import com.ninejatruth.app.presentation.theme.TruthMedium

@Composable
fun TruthScoreBadge(
    score: Int?,
    modifier: Modifier = Modifier
) {
    if (score == null) return

    val color = when {
        score >= 70 -> TruthHigh
        score >= 40 -> TruthMedium
        else -> TruthLow
    }

    val label = when {
        score >= 70 -> "High"
        score >= 40 -> "Medium"
        else -> "Low"
    }

    Row(
        modifier = modifier
            .background(color.copy(alpha = 0.12f), CircleShape)
            .padding(horizontal = 10.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, CircleShape)
        )
        Text(
            text = "$score%",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}
