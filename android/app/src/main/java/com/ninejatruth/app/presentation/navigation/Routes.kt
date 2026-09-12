package com.ninejatruth.app.presentation.navigation

object Routes {
    // Auth
    const val SPLASH = "splash"
    const val ONBOARDING = "onboarding"
    const val LOGIN = "login"
    const val REGISTER = "register"

    // Main tabs
    const val HOME = "home"
    const val POLITICS = "politics"
    const val FEEDS = "feeds"
    const val NEWS = "news"
    const val PROFILE = "profile"

    // Detail screens
    const val PARTY_DETAIL = "party/{partyId}"
    const val CANDIDATE_DETAIL = "candidate/{candidateId}"
    const val ELECTION_DETAIL = "election/{electionId}"
    const val POST_DETAIL = "post/{postId}"
    const val CREATE_POST = "create_post"
    const val NEWS_DETAIL = "news/{articleId}"
    const val SETTINGS = "settings"
    const val ASSISTANT = "assistant"

    fun partyDetail(partyId: String) = "party/$partyId"
    fun candidateDetail(candidateId: String) = "candidate/$candidateId"
    fun electionDetail(electionId: String) = "election/$electionId"
    fun postDetail(postId: String) = "post/$postId"
    fun newsDetail(articleId: String) = "news/$articleId"
}
