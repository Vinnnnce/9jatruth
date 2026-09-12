package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.User
import com.ninejatruth.app.domain.repository.AuthRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class RegisterUseCase @Inject constructor(
    private val repository: AuthRepository
) {
    operator fun invoke(
        fullName: String,
        email: String,
        password: String,
        username: String,
        phone: String,
        stateId: String? = null,
        lgaId: String? = null,
        wardId: String? = null,
        communityId: String? = null
    ): Flow<Result<User>> {
        return repository.register(
            fullName, email, password, username, phone,
            stateId, lgaId, wardId, communityId
        )
    }
}
