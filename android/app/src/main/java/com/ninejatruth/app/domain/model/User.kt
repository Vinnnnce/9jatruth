package com.ninejatruth.app.domain.model

data class User(
    val id: String,
    val fullName: String,
    val email: String,
    val username: String,
    val phone: String?,
    val avatarUrl: String?,
    val stateId: String?,
    val stateName: String?,
    val lgaId: String?,
    val lgaName: String?,
    val wardId: String?,
    val communityId: String?,
    val truthScore: Int?,
    val verified: Boolean,
    val createdAt: String?
)
