package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.Poll
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface PollsRepository {
    fun getPolls(): Flow<Result<List<Poll>>>
    fun votePoll(pollId: String, optionId: String): Flow<Result<Poll>>
}
