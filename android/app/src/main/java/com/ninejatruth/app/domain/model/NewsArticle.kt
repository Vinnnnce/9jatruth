package com.ninejatruth.app.domain.model

data class NewsArticle(
    val id: String,
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
    val tags: List<String>,
    val truthScore: Int?,
    val verified: Boolean
)
