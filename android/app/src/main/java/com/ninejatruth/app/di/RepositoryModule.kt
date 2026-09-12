package com.ninejatruth.app.di

import com.ninejatruth.app.data.repository.AuthRepositoryImpl
import com.ninejatruth.app.data.repository.FeedRepositoryImpl
import com.ninejatruth.app.data.repository.GeoRepositoryImpl
import com.ninejatruth.app.data.repository.NewsRepositoryImpl
import com.ninejatruth.app.data.repository.PollsRepositoryImpl
import com.ninejatruth.app.data.repository.PoliticsRepositoryImpl
import com.ninejatruth.app.domain.repository.AuthRepository
import com.ninejatruth.app.domain.repository.FeedRepository
import com.ninejatruth.app.domain.repository.GeoRepository
import com.ninejatruth.app.domain.repository.NewsRepository
import com.ninejatruth.app.domain.repository.PollsRepository
import com.ninejatruth.app.domain.repository.PoliticsRepository
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository

    @Binds
    @Singleton
    abstract fun bindFeedRepository(impl: FeedRepositoryImpl): FeedRepository

    @Binds
    @Singleton
    abstract fun bindPoliticsRepository(impl: PoliticsRepositoryImpl): PoliticsRepository

    @Binds
    @Singleton
    abstract fun bindNewsRepository(impl: NewsRepositoryImpl): NewsRepository

    @Binds
    @Singleton
    abstract fun bindPollsRepository(impl: PollsRepositoryImpl): PollsRepository

    @Binds
    @Singleton
    abstract fun bindGeoRepository(impl: GeoRepositoryImpl): GeoRepository
}
