package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.AuthResponse
import com.ninejatruth.app.data.remote.dto.LoginRequest
import com.ninejatruth.app.data.remote.dto.RegisterRequest
import com.ninejatruth.app.data.remote.dto.UserDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AuthApi {

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<ApiResponse<AuthResponse, Any>>

    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<AuthResponse, Any>>

    @POST("auth/refresh")
    suspend fun refresh(@Body refreshToken: Map<String, String>): Response<ApiResponse<AuthResponse, Any>>

    @POST("auth/logout")
    suspend fun logout(): Response<ApiResponse<Unit, Any>>

    @POST("auth/me")
    suspend fun getMe(): Response<ApiResponse<UserDto, Any>>
}
