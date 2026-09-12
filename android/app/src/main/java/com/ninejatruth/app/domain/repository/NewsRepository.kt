package com.ninejatruth.app.domain.repository

import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow

interface NewsRepository {
    fun getNews(page: Int, category: String?, stateId: String?): Flow<Result<List<NewsArticle>>>
    fun getNewsArticle(articleId: String): Flow<Result<NewsArticle>>
}
