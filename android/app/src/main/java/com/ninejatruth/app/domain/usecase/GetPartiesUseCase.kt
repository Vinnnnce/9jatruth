package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.Party
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetPartiesUseCase @Inject constructor(
    private val repository: PoliticsRepository
) {
    operator fun invoke(page: Int = 1): Flow<Result<List<Party>>> {
        return repository.getParties(page)
    }
}
