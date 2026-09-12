package com.ninejatruth.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "news")
data class NewsEntity(
    @PrimaryKey val id: String,
    val title: String,
    val content: String?,
    val summary: String?,
    val imageUrl: String?,
    val category: String,
    val source: String,
    val sourceUrl: String,
    val author: String?,
    val publishedAt: String,
    val readTime: Int?,
    val truthScore: Int?,
    val verified: Boolean
)
