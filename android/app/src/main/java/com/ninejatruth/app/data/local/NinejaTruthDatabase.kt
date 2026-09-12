package com.ninejatruth.app.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.ninejatruth.app.data.local.dao.NewsDao
import com.ninejatruth.app.data.local.dao.PartyDao
import com.ninejatruth.app.data.local.dao.PostDao
import com.ninejatruth.app.data.local.dao.UserDao
import com.ninejatruth.app.data.local.entity.CandidateEntity
import com.ninejatruth.app.data.local.entity.NewsEntity
import com.ninejatruth.app.data.local.entity.PartyEntity
import com.ninejatruth.app.data.local.entity.PostEntity
import com.ninejatruth.app.data.local.entity.UserEntity

@Database(
    entities = [
        PostEntity::class,
        NewsEntity::class,
        PartyEntity::class,
        CandidateEntity::class,
        UserEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class NinejaTruthDatabase : RoomDatabase() {

    abstract fun postDao(): PostDao
    abstract fun newsDao(): NewsDao
    abstract fun partyDao(): PartyDao
    abstract fun userDao(): UserDao

    companion object {
        const val DATABASE_NAME = "ninejatruth.db"
    }
}
