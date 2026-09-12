package com.ninejatruth.app.domain.usecase

import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.repository.NewsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject

class GetNewsUseCase @Inject constructor(
    private val repository: NewsRepository
) {
    operator fun invoke(page: Int = 1, category: String? = null, stateId: String? = null): Flow<Result<List<NewsArticle>>> {
        return repository.getNews(page, category, stateId)
    }
}
