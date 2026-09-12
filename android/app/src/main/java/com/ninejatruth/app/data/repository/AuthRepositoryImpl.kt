package com.ninejatruth.app.data.repository

import com.ninejatruth.app.data.DataStoreManager
import com.ninejatruth.app.data.local.dao.UserDao
import com.ninejatruth.app.data.local.entity.UserEntity
import com.ninejatruth.app.data.remote.api.AuthApi
import com.ninejatruth.app.data.remote.dto.LoginRequest
import com.ninejatruth.app.data.remote.dto.RegisterRequest
import com.ninejatruth.app.domain.model.User
import com.ninejatruth.app.domain.repository.AuthRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val userDao: UserDao,
    private val dataStoreManager: DataStoreManager
) : AuthRepository {

    override fun login(email: String, password: String): Flow<Result<User>> = flow {
        emit(Result.Loading)
        try {
            val response = authApi.login(LoginRequest(email, password))
            if (response.isSuccessful) {
                val body = response.body()
                val authData = body?.data
                if (authData != null) {
                    dataStoreManager.saveAccessToken(authData.accessToken)
                    dataStoreManager.saveRefreshToken(authData.refreshToken)
                    dataStoreManager.saveUserId(authData.user.id)
                    dataStoreManager.saveOnboardingCompleted(true)

                    userDao.insertUser(authData.user.toEntity())

                    emit(Result.Success(authData.user.toDomain()))
                } else {
                    emit(Result.Error(body?.message ?: "Login failed"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Login failed"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun register(
        fullName: String,
        email: String,
        password: String,
        username: String,
        phone: String,
        stateId: String?,
        lgaId: String?,
        wardId: String?,
        communityId: String?
    ): Flow<Result<User>> = flow {
        emit(Result.Loading)
        try {
            val request = RegisterRequest(
                fullName = fullName,
                email = email,
                password = password,
                username = username,
                phone = phone,
                stateId = stateId,
                lgaId = lgaId,
                wardId = wardId,
                communityId = communityId
            )
            val response = authApi.register(request)
            if (response.isSuccessful) {
                val body = response.body()
                val authData = body?.data
                if (authData != null) {
                    dataStoreManager.saveAccessToken(authData.accessToken)
                    dataStoreManager.saveRefreshToken(authData.refreshToken)
                    dataStoreManager.saveUserId(authData.user.id)
                    dataStoreManager.saveOnboardingCompleted(true)

                    userDao.insertUser(authData.user.toEntity())

                    emit(Result.Success(authData.user.toDomain()))
                } else {
                    emit(Result.Error(body?.message ?: "Registration failed"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Registration failed"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun getCurrentUser(): Flow<User?> = userDao.getCurrentUser().map { entity ->
        entity?.toDomain()
    }

    override suspend fun logout() {
        try {
            authApi.logout()
        } catch (_: Exception) {
            // Ignore network errors during logout
        }
        dataStoreManager.clearAll()
        userDao.clearAll()
    }

    override fun isLoggedIn(): Flow<Boolean> = flow {
        emit(dataStoreManager.getAccessToken() != null)
    }

    private fun com.ninejatruth.app.data.remote.dto.UserDto.toEntity() = UserEntity(
        id = id,
        fullName = fullName,
        email = email,
        username = username,
        phone = phone,
        avatarUrl = avatarUrl,
        stateId = stateId,
        stateName = stateName,
        lgaId = lgaId,
        lgaName = lgaName,
        wardId = wardId,
        communityId = communityId,
        truthScore = truthScore,
        verified = verified,
        createdAt = createdAt
    )

    private fun com.ninejatruth.app.data.remote.dto.UserDto.toDomain() = User(
        id = id,
        fullName = fullName,
        email = email,
        username = username,
        phone = phone,
        avatarUrl = avatarUrl,
        stateId = stateId,
        stateName = stateName,
        lgaId = lgaId,
        lgaName = lgaName,
        wardId = wardId,
        communityId = communityId,
        truthScore = truthScore,
        verified = verified,
        createdAt = createdAt
    )

    private fun UserEntity.toDomain() = User(
        id = id,
        fullName = fullName,
        email = email,
        username = username,
        phone = phone,
        avatarUrl = avatarUrl,
        stateId = stateId,
        stateName = stateName,
        lgaId = lgaId,
        lgaName = lgaName,
        wardId = wardId,
        communityId = communityId,
        truthScore = truthScore,
        verified = verified,
        createdAt = createdAt
    )
}
