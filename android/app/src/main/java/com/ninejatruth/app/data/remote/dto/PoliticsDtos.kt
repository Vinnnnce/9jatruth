package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PartyDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("acronym") val acronym: String,
    @SerializedName("logoUrl") val logoUrl: String?,
    @SerializedName("color") val color: String?,
    @SerializedName("foundedYear") val foundedYear: Int?,
    @SerializedName("ideology") val ideology: String?,
    @SerializedName("motto") val motto: String?,
    @SerializedName("chairman") val chairman: String?,
    @SerializedName("headquarters") val headquarters: String?,
    @SerializedName("website") val website: String?,
    @SerializedName("truthScore") val truthScore: Int?,
    @SerializedName("memberCount") val memberCount: Int? = null,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class CandidateDto(
    @SerializedName("id") val id: String,
    @SerializedName("fullName") val fullName: String,
    @SerializedName("partyId") val partyId: String?,
    @SerializedName("partyName") val partyName: String?,
    @SerializedName("partyAcronym") val partyAcronym: String?,
    @SerializedName("partyLogoUrl") val partyLogoUrl: String?,
    @SerializedName("officeId") val officeId: String?,
    @SerializedName("officeName") val officeName: String?,
    @SerializedName("stateId") val stateId: String?,
    @SerializedName("stateName") val stateName: String?,
    @SerializedName("photoUrl") val photoUrl: String?,
    @SerializedName("bio") val bio: String?,
    @SerializedName("education") val education: List<String> = emptyList(),
    @SerializedName("experience") val experience: List<String> = emptyList(),
    @SerializedName("promises") val promises: List<String> = emptyList(),
    @SerializedName("truthScore") val truthScore: Int?,
    @SerializedName("verified") val verified: Boolean = false,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class OfficeDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("level") val level: String,
    @SerializedName("description") val description: String?,
    @SerializedName("termLength") val termLength: Int?,
    @SerializedName("termLimit") val termLimit: Int?,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)

data class ElectionDto(
    @SerializedName("id") val id: String,
    @SerializedName("title") val title: String,
    @SerializedName("type") val type: String,
    @SerializedName("officeId") val officeId: String?,
    @SerializedName("officeName") val officeName: String?,
    @SerializedName("stateId") val stateId: String?,
    @SerializedName("stateName") val stateName: String?,
    @SerializedName("date") val date: String,
    @SerializedName("status") val status: String,
    @SerializedName("registrationDeadline") val registrationDeadline: String?,
    @SerializedName("description") val description: String?,
    @SerializedName("totalVotes") val totalVotes: Int? = null,
    @SerializedName("turnout") val turnout: Double? = null,
    @SerializedName("createdAt") val createdAt: String?,
    @SerializedName("updatedAt") val updatedAt: String?
)
