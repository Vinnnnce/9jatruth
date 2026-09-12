package com.ninejatruth.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ninejatruth.app.data.local.entity.NewsEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface NewsDao {

    @Query("SELECT * FROM news ORDER BY publishedAt DESC")
    fun getAllNews(): Flow<List<NewsEntity>>

    @Query("SELECT * FROM news WHERE category = :category ORDER BY publishedAt DESC")
    fun getNewsByCategory(category: String): Flow<List<NewsEntity>>

    @Query("SELECT * FROM news WHERE id = :articleId")
    suspend fun getNewsById(articleId: String): NewsEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertNews(news: List<NewsEntity>)

    @Query("DELETE FROM news")
    suspend fun clearAll()
}
