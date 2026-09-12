package com.ninejatruth.app.presentation.feeds

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.ninejatruth.app.domain.util.Result
import com.ninejatruth.app.presentation.theme.ButtonShape
import com.ninejatruth.app.presentation.theme.NigeriaGreen

@Composable
fun CreatePostScreen(
    onBack: () -> Unit,
    onPostCreated: () -> Unit,
    viewModel: FeedsViewModel = hiltViewModel()
) {
    val createPostState by viewModel.createPostState.collectAsState()

    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var tags by remember { mutableStateOf("") }

    LaunchedEffect(createPostState) {
        if (createPostState is Result.Success) {
            viewModel.resetCreatePostState()
            onPostCreated()
        }
    }

    Scaffold(
        topBar = {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                TextButton(onClick = onBack) {
                    Text("Cancel", color = NigeriaGreen)
                }
                Text(
                    text = "Create Post",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.width(48.dp))
            }
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            OutlinedTextField(
                value = title,
                onValueChange = { title = it },
                label = { Text("Post Title") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = ButtonShape
            )

            OutlinedTextField(
                value = content,
                onValueChange = { content = it },
                label = { Text("Share your thoughts...") },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp),
                shape = ButtonShape
            )

            OutlinedTextField(
                value = tags,
                onValueChange = { tags = it },
                label = { Text("Tags (comma separated)") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = ButtonShape
            )

            val error = (createPostState as? Result.Error)?.message
            if (error != null) {
                Text(
                    text = error,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }

            Button(
                onClick = {
                    val tagList = tags.split(",").map { it.trim() }.filter { it.isNotBlank() }
                    viewModel.createPost(title, content, tagList)
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = title.isNotBlank() && content.isNotBlank() &&
                        createPostState !is Result.Loading,
                shape = ButtonShape,
                colors = ButtonDefaults.buttonColors(containerColor = NigeriaGreen)
            ) {
                if (createPostState is Result.Loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = androidx.compose.ui.graphics.Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text("Publish", fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}
