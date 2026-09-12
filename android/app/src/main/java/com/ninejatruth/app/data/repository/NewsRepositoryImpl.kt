package com.ninejatruth.app.data.repository

import com.ninejatruth.app.data.local.dao.NewsDao
import com.ninejatruth.app.data.local.entity.NewsEntity
import com.ninejatruth.app.data.remote.api.NewsApi
import com.ninejatruth.app.domain.model.NewsArticle
import com.ninejatruth.app.domain.repository.NewsRepository
import com.ninejatruth.app.domain.util.Result
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NewsRepositoryImpl @Inject constructor(
    private val newsApi: NewsApi,
    private val newsDao: NewsDao
) : NewsRepository {

    override fun getNews(page: Int, category: String?, stateId: String?): Flow<Result<List<NewsArticle>>> = flow {
        emit(Result.Loading)
        try {
            val response = newsApi.getNews(page, 20, category, stateId)
            if (response.isSuccessful) {
                val articles = response.body()?.data?.map { it.toDomain() } ?: emptyList()
                newsDao.insertNews(articles.map { it.toEntity() })
                emit(Result.Success(articles))
            } else {
                emit(Result.Error(response.message() ?: "Failed to load news"))
            }
        } catch (e: Exception) {
            // Try cache
            val cachedFlow = if (category != null) {
                newsDao.getNewsByCategory(category)
            } else {
                newsDao.getAllNews()
            }
            cachedFlow.collect { cached ->
                if (cached.isNotEmpty()) {
                    emit(Result.Success(cached.map { it.toDomain() }))
                } else {
                    emit(Result.Error(e.localizedMessage ?: "Network error"))
                }
                return@collect
            }
        }
    }

    override fun getNewsArticle(articleId: String): Flow<Result<NewsArticle>> = flow {
        emit(Result.Loading)
        try {
            val response = newsApi.getNewsArticle(articleId)
            if (response.isSuccessful) {
                val article = response.body()?.data?.toDomain()
                if (article != null) {
                    emit(Result.Success(article))
                } else {
                    emit(Result.Error("Article not found"))
                }
            } else {
                val cached = newsDao.getNewsById(articleId)
                if (cached != null) {
                    emit(Result.Success(cached.toDomain()))
                } else {
                    emit(Result.Error(response.message() ?: "Failed to load article"))
                }
            }
        } catch (e: Exception) {
            val cached = newsDao.getNewsById(articleId)
            if (cached != null) {
                emit(Result.Success(cached.toDomain()))
            } else {
                emit(Result.Error(e.localizedMessage ?: "Network error"))
            }
        }
    }

    private fun com.ninejatruth.app.data.remote.dto.NewsArticleDto.toDomain() = NewsArticle(
        id = id,
        title = title,
        content = content,
        summary = summary,
        imageUrl = imageUrl,
        category = category,
        source = source,
        sourceUrl = sourceUrl,
        author = author,
        publishedAt = publishedAt,
        readTime = readTime,
        tags = tags,
        truthScore = truthScore,
        verified = verified
    )

    private fun NewsArticle.toEntity() = NewsEntity(
        id = id,
        title = title,
        content = content,
        summary = summary,
        imageUrl = imageUrl,
        category = category,
        source = source,
        sourceUrl = sourceUrl,
        author = author,
        publishedAt = publishedAt,
        readTime = readTime,
        truthScore = truthScore,
        verified = verified
    )

    private fun NewsEntity.toDomain() = NewsArticle(
        id = id,
        title = title,
        content = content,
        summary = summary,
        imageUrl = imageUrl,
        category = category,
        source = source,
        sourceUrl = sourceUrl,
        author = author,
        publishedAt = publishedAt,
        readTime = readTime,
        tags = emptyList(),
        truthScore = truthScore,
        verified = verified
    )
}
