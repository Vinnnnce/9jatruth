package com.ninejatruth.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "candidates")
data class CandidateEntity(
    @PrimaryKey val id: String,
    val fullName: String,
    val partyId: String?,
    val partyName: String?,
    val partyAcronym: String?,
    val partyLogoUrl: String?,
    val officeId: String?,
    val officeName: String?,
    val stateId: String?,
    val stateName: String?,
    val photoUrl: String?,
    val bio: String?,
    val truthScore: Int?,
    val verified: Boolean
)
