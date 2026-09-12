package com.ninejatruth.app.data.remote.api

import com.ninejatruth.app.data.remote.dto.ApiResponse
import com.ninejatruth.app.data.remote.dto.NewsArticleDto
import com.ninejatruth.app.data.remote.dto.PaginationMeta
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface NewsApi {

    @GET("news")
    suspend fun getNews(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("category") category: String? = null,
        @Query("stateId") stateId: String? = null
    ): Response<ApiResponse<List<NewsArticleDto>, PaginationMeta>>

    @GET("news/{id}")
    suspend fun getNewsArticle(@Path("id") articleId: String): Response<ApiResponse<NewsArticleDto, Any>>
}
