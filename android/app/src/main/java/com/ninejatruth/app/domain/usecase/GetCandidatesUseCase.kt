package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.Candidate
import com.ninejatruth.app.domain.repository.PoliticsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetCandidatesUseCase @Inject constructor(
    private val repository: PoliticsRepository
) {
    operator fun invoke(
        page: Int = 1,
        partyId: String? = null,
        officeId: String? = null,
        stateId: String? = null
    ): Flow<Result<List<Candidate>>> {
        return repository.getCandidates(page, partyId, officeId, stateId)
    }
}
