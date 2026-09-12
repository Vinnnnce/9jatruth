package com.ninejatruth.app.di

import android.content.Context
import androidx.room.Room
import com.ninejatruth.app.data.local.NinejaTruthDatabase
import com.ninejatruth.app.data.local.dao.NewsDao
import com.ninejatruth.app.data.local.dao.PartyDao
import com.ninejatruth.app.data.local.dao.PostDao
import com.ninejatruth.app.data.local.dao.UserDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): NinejaTruthDatabase =
        Room.databaseBuilder(
            context,
            NinejaTruthDatabase::class.java,
            "ninejatruth.db"
        )
            .fallbackToDestructiveMigration()
            .build()

    @Provides
    @Singleton
    fun providePostDao(db: NinejaTruthDatabase): PostDao = db.postDao()

    @Provides
    @Singleton
    fun provideNewsDao(db: NinejaTruthDatabase): NewsDao = db.newsDao()

    @Provides
    @Singleton
    fun providePartyDao(db: NinejaTruthDatabase): PartyDao = db.partyDao()

    @Provides
    @Singleton
    fun provideUserDao(db: NinejaTruthDatabase): UserDao = db.userDao()
}
