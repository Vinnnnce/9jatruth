package com.ninejatruth.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "parties")
data class PartyEntity(
    @PrimaryKey val id: String,
    val name: String,
    val acronym: String,
    val logoUrl: String?,
    val color: String?,
    val foundedYear: Int?,
    val ideology: String?,
    val chairman: String?,
    val headquarters: String?,
    val truthScore: Int?
)
