package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.repository.FeedRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetFeedsUseCase @Inject constructor(
    private val repository: FeedRepository
) {
    operator fun invoke(page: Int = 1, category: String? = null, stateId: String? = null): Flow<Result<List<Post>>> {
        return repository.getFeeds(page, category, stateId)
    }
}
