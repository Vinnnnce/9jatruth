package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.State
import com.ninejatruth.app.domain.repository.GeoRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetStatesUseCase @Inject constructor(
    private val repository: GeoRepository
) {
    operator fun invoke(): Flow<Result<List<State>>> {
        return repository.getStates()
    }
}
