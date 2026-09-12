package com.ninejatruth.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "users")
data class UserEntity(
    @PrimaryKey val id: String,
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
