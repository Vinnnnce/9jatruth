package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class NewsArticleDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("content") val content: String?,
    @SerializedName("summary") val summary: String?,
    @SerializedName("imageUrl") val imageUrl: String?,
    @SerializedName("category") val category: String,
    @SerializedName("source") val source: String,
    @SerializedName("sourceUrl") val sourceUrl: String,
    @SerializedName("author") val author: String?,
    @SerializedName("publishedAt") val publishedAt: String,
    @SerializedName("readTime") val readTime: Int? = null,
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("truthScore") val truthScore: Int? = null,
    @SerializedName("verified") val verified: Boolean = false
)
