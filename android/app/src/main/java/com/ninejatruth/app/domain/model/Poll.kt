package com.ninejatruth.app.domain.model

data class Poll(
    val id: String,
    val question: String,
    val description: String?,
    val options: List<PollOption>,
    val totalVotes: Int,
    val closesAt: String?,
    val active: Boolean,
    val userVoted: Boolean,
    val userOptionId: String?
)

data class PollOption(
    val id: String,
    val text: String,
    val votes: Int,
    val percentage: Double
)
