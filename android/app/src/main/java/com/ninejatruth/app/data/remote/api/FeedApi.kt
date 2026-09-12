package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.CommentDto
import com.ninejatruth.app.data.remote.dto.CreateCommentRequest
import com.ninejatruth.app.data.remote.dto.CreatePostRequest
import com.ninejatruth.app.data.remote.dto.CreateReactionRequest
import com.ninejatruth.app.data.remote.dto.PaginationMeta
import com.ninejatruth.app.data.remote.dto.PostDto
import com.ninejatruth.app.data.remote.dto.ReactionDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface FeedApi {

    @GET("feeds")
    suspend fun getFeeds(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("category") category: String? = null,
        @Query("stateId") stateId: String? = null
    ): Response<ApiResponse<List<PostDto>, PaginationMeta>>

    @GET("feeds/{id}")
    suspend fun getPost(@Path("id") postId: String): Response<ApiResponse<PostDto>>

    @POST("feeds")
    suspend fun createPost(@Body request: CreatePostRequest): Response<ApiResponse<PostDto>>

    @POST("feeds/{id}/comments")
    suspend fun createComment(
        @Path("id") postId: String,
        @Body request: CreateCommentRequest
    ): Response<ApiResponse<CommentDto>>

    @POST("feeds/{id}/reactions")
    suspend fun createReaction(
        @Path("id") postId: String,
        @Body request: CreateReactionRequest
    ): Response<ApiResponse<ReactionDto>>
}
