package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.User
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    fun login(email: String, password: String): Flow<Result<User>>
    fun register(
        fullName: String,
        email: String,
        password: String,
        username: String,
        phone: String,
        stateId: String?,
        lgaId: String?,
        wardId: String?,
        communityId: String?
    ): Flow<Result<User>>
    fun getCurrentUser(): Flow<User?>
    suspend fun logout()
    fun isLoggedIn(): Flow<Boolean>
}
