package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.Comment
import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.model.Reaction
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface FeedRepository {
    fun getFeeds(page: Int, category: String?, stateId: String?): Flow<Result<List<Post>>>
    fun getPost(postId: String): Flow<Result<Post>>
    fun createPost(
        title: String,
        content: String,
        categoryId: String?,
        stateId: String?,
        tags: List<String>
    ): Flow<Result<Post>>
    fun createComment(postId: String, content: String): Flow<Result<Comment>>
    fun createReaction(postId: String, type: String): Flow<Result<Reaction>>
}
