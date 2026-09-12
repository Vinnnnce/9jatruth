package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.PollDto
import com.ninejatruth.app.data.remote.dto.VoteRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface PollsApi {

    @GET("polls")
    suspend fun getPolls(): Response<ApiResponse<List<PollDto>>>

    @GET("polls/{id}")
    suspend fun getPoll(@Path("id") pollId: String): Response<ApiResponse<PollDto>>

    @POST("polls/{id}/vote")
    suspend fun votePoll(
        @Path("id") pollId: String,
        @Body request: VoteRequest
    ): Response<ApiResponse<PollDto>>
}
