package com.ninejatruth.app.data.local.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.ninejatruth.app.data.local.entity.PartyEntity
import kotlinx.coroutines.flow.Flow

@Dao
interface PartyDao {

    @Query("SELECT * FROM parties ORDER BY name ASC")
    fun getAllParties(): Flow<List<PartyEntity>>

    @Query("SELECT * FROM parties WHERE id = :partyId")
    suspend fun getPartyById(partyId: String): PartyEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertParties(parties: List<PartyEntity>)

    @Query("DELETE FROM parties")
    suspend fun clearAll()
}
