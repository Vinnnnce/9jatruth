package com.ninejatruth.app.data.repository

import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.ninejatruth.app.data.local.dao.PostDao
import com.ninejatruth.app.data.local.entity.PostEntity
import com.ninejatruth.app.data.remote.api.FeedApi
import com.ninejatruth.app.data.remote.dto.CreatePostRequest
import com.ninejatruth.app.domain.model.Comment
import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.model.Reaction
import com.ninejatruth.app.domain.repository.FeedRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepositoryImpl @Inject constructor(
    private val feedApi: FeedApi,
    private val postDao: PostDao,
    private val gson: Gson
) : FeedRepository {

    override fun getFeeds(page: Int, category: String?, stateId: String?): Flow<Result<List<Post>>> = flow {
        emit(Result.Loading)
        try {
            val response = feedApi.getFeeds(page, 20, category, stateId)
            if (response.isSuccessful) {
                val posts = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                // Cache locally
                postDao.insertPosts(posts.map { it.toEntity() })
                emit(Result.Success(posts))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load feeds"))
            }
        } catch (e: Exception) {
            // Try cache
            val cached = postDao.getAllPosts()
            cached.collect { entities ->
                if (entities.isNotEmpty()) {
                    emit(Result.Success(entities.map { it.toDomain() }))
                } else {
                    emit(Result.Error(e.localizedMessage ?: "Network error"))
                }
                return@collect
            }
        }
    }

    override fun getPost(postId: String): Flow<Result<Post>> = flow {
        emit(Result.Loading)
        try {
            val response = feedApi.getPost(postId)
            if (response.isSuccessful) {
                val post = response.body()?.data?.toDomain()
                if (post != null) {
                    postDao.insertPost(post.toEntity())
                    emit(Result.Success(post))
                } else {
                    emit(Result.Error("Post not found"))
                }
            } else {
                // Try cache
                val cached = postDao.getPostById(postId)
                if (cached != null) {
                    emit(Result.Success(cached.toDomain()))
                } else {
                    emit(Result.Error(response.message() ?: "Failed to load post"))
                }
            }
        } catch (e: Exception) {
            val cached = postDao.getPostById(postId)
            if (cached != null) {
                emit(Result.Success(cached.toDomain()))
            } else {
                emit(Result.Error(e.localizedMessage ?: "Network error"))
            }
        }
    }

    override fun createPost(
        title: String,
        content: String,
        categoryId: String?,
        stateId: String?,
        tags: List<String>
    ): Flow<Result<Post>> = flow {
        emit(Result.Loading)
        try {
            val request = CreatePostRequest(title, content, categoryId, stateId, tags)
            val response = feedApi.createPost(request)
            if (response.isSuccessful) {
                val post = response.body()?.data?.toDomain()
                if (post != null) {
                    postDao.insertPost(post.toEntity())
                    emit(Result.Success(post))
                } else {
                    emit(Result.Error("Failed to create post"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to create post"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun createComment(postId: String, content: String): Flow<Result<Comment>> = flow {
        emit(Result.Loading)
        try {
            val response = feedApi.createComment(
                postId,
                com.ninejatruth.app.data.remote.dto.CreateCommentRequest(content)
            )
            if (response.isSuccessful) {
                val comment = response.body()?.data?.toDomain()
                if (comment != null) {
                    emit(Result.Success(comment))
                } else {
                    emit(Result.Error("Failed to add comment"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to add comment"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun createReaction(postId: String, type: String): Flow<Result<Reaction>> = flow {
        emit(Result.Loading)
        try {
            val response = feedApi.createReaction(
                postId,
                com.ninejatruth.app.data.remote.dto.CreateReactionRequest(type)
            )
            if (response.isSuccessful) {
                val reaction = response.body()?.data?.toDomain()
                if (reaction != null) {
                    emit(Result.Success(reaction))
                } else {
                    emit(Result.Error("Failed to add reaction"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to add reaction"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    // --- Mapping functions ---

    private fun com.ninejatruth.app.data.remote.dto.PostDto.toDomain() = Post(
        id = id,
        title = title,
        content = content,
        snippet = snippet,
        authorId = authorId,
        authorName = authorName,
        authorAvatarUrl = authorAvatarUrl,
        categoryId = categoryId,
        categoryName = categoryName,
        stateId = stateId,
        stateName = stateName,
        tags = tags,
        truthScore = truthScore,
        upvotes = upvotes,
        downvotes = downvotes,
        commentCount = commentCount,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun com.ninejatruth.app.data.remote.dto.CommentDto.toDomain() = Comment(
        id = id,
        postId = postId,
        authorId = authorId,
        authorName = authorName,
        authorAvatarUrl = authorAvatarUrl,
        content = content,
        upvotes = upvotes,
        downvotes = downvotes,
        createdAt = createdAt
    )

    private fun com.ninejatruth.app.data.remote.dto.ReactionDto.toDomain() = Reaction(
        id = id,
        postId = postId,
        userId = userId,
        type = type,
        createdAt = createdAt
    )

    private fun Post.toEntity() = PostEntity(
        id = id,
        title = title,
        content = content,
        snippet = snippet,
        authorId = authorId,
        authorName = authorName,
        authorAvatarUrl = authorAvatarUrl,
        categoryId = categoryId,
        categoryName = categoryName,
        stateId = stateId,
        stateName = stateName,
        tagsJson = gson.toJson(tags),
        truthScore = truthScore,
        upvotes = upvotes,
        downvotes = downvotes,
        commentCount = commentCount,
        createdAt = createdAt,
        updatedAt = updatedAt
    )

    private fun PostEntity.toDomain(): Post {
        val tagsType = object : TypeToken<List<String>>() {}.type
        val tags: List<String> = try {
            gson.fromJson(tagsJson, tagsType) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        return Post(
            id = id,
            title = title,
            content = content,
            snippet = snippet,
            authorId = authorId,
            authorName = authorName,
            authorAvatarUrl = authorAvatarUrl,
            categoryId = categoryId,
            categoryName = categoryName,
            stateId = stateId,
            stateName = stateName,
            tags = tags,
            truthScore = truthScore,
            upvotes = upvotes,
            downvotes = downvotes,
            commentCount = commentCount,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }
}
