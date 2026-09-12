package com.ninejatruth.app.domain.model

data class Party(
    val id: String,
    val name: String,
    val acronym: String,
    val logoUrl: String?,
    val color: String?,
    val foundedYear: Int?,
    val ideology: String?,
    val motto: String?,
    val chairman: String?,
    val headquarters: String?,
    val website: String?,
    val truthScore: Int?,
    val memberCount: Int?
)

data class Candidate(
    val id: String,
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
    val education: List<String>,
    val experience: List<String>,
    val promises: List<String>,
    val truthScore: Int?,
    val verified: Boolean
)

data class Office(
    val id: String,
    val title: String,
    val level: String,
    val description: String?,
    val termLength: Int?,
    val termLimit: Int?
)

data class Election(
    val id: String,
    val title: String,
    val type: String,
    val officeId: String?,
    val officeName: String?,
    val stateId: String?,
    val stateName: String?,
    val date: String,
    val status: String,
    val registrationDeadline: String?,
    val description: String?,
    val totalVotes: Int?,
    val turnout: Double?
)
