package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.Post
import com.ninejatruth.app.domain.repository.FeedRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class CreatePostUseCase @Inject constructor(
    private val repository: FeedRepository
) {
    operator fun invoke(
        title: String,
        content: String,
        categoryId: String? = null,
        stateId: String? = null,
        tags: List<String> = emptyList()
    ): Flow<Result<Post>> {
        return repository.createPost(title, content, categoryId, stateId, tags)
    }
}
