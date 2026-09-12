package com.ninejatruth.app.domain.model

data class Post(
    val id: String,
    val title: String,
    val content: String,
    val snippet: String?,
    val authorId: String,
    val authorName: String,
    val authorAvatarUrl: String?,
    val categoryId: String?,
    val categoryName: String?,
    val stateId: String?,
    val stateName: String?,
    val tags: List<String>,
    val truthScore: Int?,
    val upvotes: Int,
    val downvotes: Int,
    val commentCount: Int,
    val createdAt: String,
    val updatedAt: String?
)

data class Comment(
    val id: String,
    val postId: String,
    val authorId: String,
    val authorName: String,
    val authorAvatarUrl: String?,
    val content: String,
    val upvotes: Int,
    val downvotes: Int,
    val createdAt: String
)

data class Reaction(
    val id: String,
    val postId: String,
    val userId: String,
    val type: String,
    val createdAt: String
)
