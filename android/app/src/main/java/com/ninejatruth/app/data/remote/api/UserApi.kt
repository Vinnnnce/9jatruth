package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.UpdateUserRequest
import com.ninejatruth.app.data.remote.dto.UserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PUT

interface UserApi {

    @GET("users/me")
    suspend fun getMe(): Response<ApiResponse<UserDto>>

    @PUT("users/me")
    suspend fun updateMe(@Body request: UpdateUserRequest): Response<ApiResponse<UserDto>>
}
