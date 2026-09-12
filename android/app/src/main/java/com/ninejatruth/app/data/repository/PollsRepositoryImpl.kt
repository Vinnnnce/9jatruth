package com.ninejatruth.app.data.repository

import com.ninejatruth.app.data.remote.api.PollsApi
import com.ninejatruth.app.data.remote.dto.VoteRequest
import com.ninejatruth.app.domain.model.Poll
import com.ninejatruth.app.domain.repository.PollsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PollsRepositoryImpl @Inject constructor(
    private val pollsApi: PollsApi
) : PollsRepository {

    override fun getPolls(): Flow<Result<List<Poll>>> = flow {
        emit(Result.Loading)
        try {
            val response = pollsApi.getPolls()
            if (response.isSuccessful) {
                val polls = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                emit(Result.Success(polls))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load polls"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    override fun votePoll(pollId: String, optionId: String): Flow<Result<Poll>> = flow {
        emit(Result.Loading)
        try {
            val response = pollsApi.votePoll(pollId, VoteRequest(optionId))
            if (response.isSuccessful) {
                val poll = response.body()?.data?.toDomain()
                if (poll != null) {
                    emit(Result.Success(poll))
                } else {
                    emit(Result.Error("Failed to vote"))
                }
            } else {
                emit(Result.Error(response.message() ?: "Failed to vote"))
            }
        } catch (e: Exception) {
            emit(Result.Error(e.localizedMessage ?: "Network error"))
        }
    }

    private fun com.ninejatruth.app.data.remote.dto.PollDto.toDomain() = Poll(
        id = id,
        question = question,
        description = description,
        options = options.map { opt ->
            com.ninejatruth.app.domain.model.PollOption(
                id = opt.id,
                text = opt.text,
                votes = opt.votes,
                percentage = opt.percentage
            )
        },
        totalVotes = totalVotes,
        closesAt = closesAt,
        active = active,
        userVoted = userVoted,
        userOptionId = userOptionId
    )
}
