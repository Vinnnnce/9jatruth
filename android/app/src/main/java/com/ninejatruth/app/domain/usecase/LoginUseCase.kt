package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.User
import com.ninejatruth.app.domain.repository.AuthRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class LoginUseCase @Inject constructor(
    private val repository: AuthRepository
) {
    operator fun invoke(email: String, password: String): Flow<Result<User>> {
        return repository.login(email, password)
    }
}
