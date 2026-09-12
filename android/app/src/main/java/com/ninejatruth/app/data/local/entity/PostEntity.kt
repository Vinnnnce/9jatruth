package com.ninejatruth.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "posts")
data class PostEntity(
    @PrimaryKey val id: String,
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
    val tagsJson: String,
    val truthScore: Int?,
    val upvotes: Int,
    val downvotes: Int,
    val commentCount: Int,
    val createdAt: String,
    val updatedAt: String?
)
