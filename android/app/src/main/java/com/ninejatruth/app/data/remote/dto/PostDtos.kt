package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PostDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("content") val content: String,
    @SerializedName("snippet") val snippet: String?,
    @SerializedName("authorId") val authorId: String,
    @SerializedName("authorName") val authorName: String,
    @SerializedName("authorAvatarUrl") val authorAvatarUrl: String?,
    @SerializedName("categoryId") val categoryId: String?,
    @SerializedName("categoryName") val categoryName: String?,
    @SerializedName("stateId") val stateId: String?,
    @SerializedName("stateName") val stateName: String?,
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("attachments") val attachments: List<String> = emptyList(),
    @SerializedName("truthScore") val truthScore: Int? = null,
    @SerializedName("upvotes") val upvotes: Int = 0,
    @SerializedName("downvotes") val downvotes: Int = 0,
    @SerializedName("commentCount") val commentCount: Int = 0,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class CreatePostRequest(
    @SerializedName("title") val title: String,
    @SerializedName("content") val content: String,
    @SerializedName("categoryId") val categoryId: String?,
    @SerializedName("stateId") val stateId: String?,
    @SerializedName("tags") val tags: List<String> = emptyList(),
    @SerializedName("attachments") val attachments: List<String> = emptyList()
)

data class CommentDto(
    @SerializedName("id") val id: String,
    @SerializedName("postId") val postId: String,
    @SerializedName("authorId") val authorId: String,
    @SerializedName("authorName") val authorName: String,
    @SerializedName("authorAvatarUrl") val authorAvatarUrl: String?,
    @SerializedName("content") val content: String,
    @SerializedName("upvotes") val upvotes: Int = 0,
    @SerializedName("downvotes") val downvotes: Int = 0,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class CreateCommentRequest(
    @SerializedName("content") val content: String
)

data class ReactionDto(
    @SerializedName("id") val id: String,
    @SerializedName("postId") val postId: String,
    @SerializedName("userId") val userId: String,
    @SerializedName("type") val type: String,
    @SerializedName("createdAt") val createdAt: String
)

data class CreateReactionRequest(
    @SerializedName("type") val type: String
)
