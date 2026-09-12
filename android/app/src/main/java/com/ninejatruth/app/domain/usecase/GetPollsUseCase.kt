package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.Poll
import com.ninejatruth.app.domain.repository.PollsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetPollsUseCase @Inject constructor(
    private val repository: PollsRepository
) {
    operator fun invoke(): Flow<Result<List<Poll>>> {
        return repository.getPolls()
    }
}
