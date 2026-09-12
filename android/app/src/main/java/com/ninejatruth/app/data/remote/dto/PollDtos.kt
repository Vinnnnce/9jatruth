package com.ninejatruth.app.data.remote.dto

import com.google.gson.annotations.SerializedName

data class PollDto(
    @SerializedName("id") val id: String,
    @SerializedName("question") val question: String,
    @SerializedName("description") val description: String?,
    @SerializedName("options") val options: List<PollOptionDto>,
    @SerializedName("totalVotes") val totalVotes: Int,
    @SerializedName("closesAt") val closesAt: String?,
    @SerializedName("active") val active: Boolean,
    @SerializedName("createdAt") val createdAt: String,
    @SerializedName("userVoted") val userVoted: Boolean = false,
    @SerializedName("userOptionId") val userOptionId: String? = null
)

data class PollOptionDto(
    @SerializedName("id") val id: String,
    @SerializedName("text") val text: String,
    @SerializedName("votes") val votes: Int,
    @SerializedName("percentage") val percentage: Double
)

data class VoteRequest(
    @SerializedName("optionId") val optionId: String
)
