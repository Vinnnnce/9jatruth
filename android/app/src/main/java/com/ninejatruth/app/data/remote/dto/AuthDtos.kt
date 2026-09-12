package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("fullName") val fullName: String,
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("username") val username: String,
    @SerializedName("phone") val phone: String,
    @SerializedName("stateId") val stateId: String? = null,
    @SerializedName("lgaId") val lgaId: String? = null,
    @SerializedName("wardId") val wardId: String? = null,
    @SerializedName("communityId") val communityId: String? = null
)

data class AuthResponse(
    @SerializedName("user") val user: UserDto,
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String
)

data class UserDto(
    @SerializedName("id") val id: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("email") val email: String,
    @SerializedName("username") val username: String,
    @SerializedName("phone") val phone: String?,
    @SerializedName("avatarUrl") val avatarUrl: String?,
    @SerializedName("stateId") val stateId: String?,
    @SerializedName("stateName") val stateName: String?,
    @SerializedName("lgaId") val lgaId: String?,
    @SerializedName("lgaName") val lgaName: String?,
    @SerializedName("wardId") val wardId: String?,
    @SerializedName("communityId") val communityId: String?,
    @SerializedName("truthScore") val truthScore: Int?,
    @SerializedName("verified") val verified: Boolean = false,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("lastLoginAt") val lastLoginAt: String?
)

data class UpdateUserRequest(
    @SerializedName("fullName") val fullName: String? = null,
    @SerializedName("phone") val phone: String? = null,
    @SerializedName("avatarUrl") val avatarUrl: String? = null,
    @SerializedName("stateId") val stateId: String? = null,
    @SerializedName("lgaId") val lgaId: String? = null,
    @SerializedName("wardId") val wardId: String? = null,
    @SerializedName("communityId") val communityId: String? = null
)
